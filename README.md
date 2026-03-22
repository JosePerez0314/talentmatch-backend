# 🚀 TalentMatch AI - Backend Core (API & Matching Engine)

## 📖 Executive Overview

Welcome to the backend repository of **TalentMatch AI**.

TalentMatch AI is an intelligent, automated recruitment platform. This backend system acts as the "brain" of the operation. It is responsible for securely receiving candidate resumes (PDFs), reading them using Artificial Intelligence, and mathematically calculating exactly how well a candidate fits a specific job vacancy.

Our goal is to eliminate the manual hours HR teams spend reading unqualified CVs, providing them with a highly accurate, instantly ranked "Top 10" Leaderboard of the best talent.

---

## 🧠 How the System Works (The 6-Step Pipeline)

When a recruiter uploads a batch of resumes, our backend processes them through a strict, automated pipeline:

1. **Secure Upload:** The system receives the PDF resumes and securely stores them in the cloud.
2. **Text Extraction:** We use specialized tools to instantly read all the visual text inside the PDF document.
3. **Quality Control:** If a PDF is corrupted, scanned poorly, or illegible, the system immediately flags and discards it to protect data integrity.
4. **AI Reading (The LLM):** This is where the magic happens. We send the raw, messy text of the resume to an advanced AI model. The AI acts as a human reader—it extracts the candidate's skills, years of experience, education, and languages into a clean, organized digital profile.
5. **The Matching Engine:** The AI _does not_ score the candidate. Instead, our custom backend algorithm takes the AI's clean profile and mathematically compares it against the strict rules of the Job Vacancy.
6. **Database Storage:** The final candidate profile and their exact "Match Score" are permanently saved in our secure database, ready to be displayed on the recruiter's dashboard.

---

## 🎯 The Matching Engine: How We Calculate the Score

To ensure 100% fairness and accuracy, the AI does not guess the score. Our backend uses a deterministic, mathematical algorithm to score candidates out of 100 points based on the following weights:

- **Hard Skills (30%):** Does the candidate have the exact technical tools required?
- **Experience (20%):** Does the candidate have the required years in the industry?
- **Role Matching (15%):** Does their past job title semantically match our vacancy?
- **Languages (15%):** Do they speak the required languages (e.g., English B2)?
- **Education (10%):** Do they have the required degrees or certifications?
- **Soft Skills (10%):** Do they show leadership, problem-solving, or communication skills?

### ⚖️ Special Business Rules

To mimic the intuition of a real Senior Recruiter, our algorithm includes special rules:

- **The "Lifesaver" Rule:** If a candidate lacks the required years of formal experience but has built strong personal projects, the system automatically awards them partial experience points so top junior talent isn't ignored. _(Note: This is disabled for strict fields like Medicine or Law)._
- **The "Guillotine" Rule:** If a candidate is completely missing a mandatory, non-negotiable skill, their final score suffers a massive penalty, instantly removing them from the top ranking.

---

## 🛠️ The Technical Stack (For Developers)

For technical stakeholders, this backend is built for speed, scalability, and relational data integrity:

- **Environment:** Node.js & Express.js (RESTful API Architecture)
- **Database:** MySQL (Hosted on Aiven for cloud reliability)
- **ORM:** Prisma (For strict database modeling and type safety)
- **File Storage:** Cloudinary (For secure PDF hosting)
- **Document Parsing:** `pdf-parse` (For raw text extraction)
- **AI Integration:** OpenAI / Google Gemini (For unstructured data parsing)

---

## 🔒 Security & Architecture

This API follows strict RESTful conventions and Separation of Concerns (SoC). Routes are decoupled into dedicated resources (`/api/users`, `/api/positions`, `/api/uploads`) to ensure the codebase remains maintainable, scalable, and easy to audit as the platform grows.
