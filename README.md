# 🚀 TalentMatch AI - Backend Architecture & Matching Engine

## 📖 Executive Overview

Welcome to the backend repository of **TalentMatch AI**.

TalentMatch AI is an intelligent, multi-tenant SaaS platform designed to automate and optimize the technical recruitment process. This backend system acts as the "brain" of the operation. It is responsible for securely receiving candidate resumes (PDFs), reading them using Artificial Intelligence, and mathematically calculating exactly how well a candidate fits a specific job vacancy.

Our goal is to eliminate the manual hours HR teams spend reading unqualified CVs, providing them with a highly accurate, instantly ranked "Top 10" Leaderboard of the best talent.

---

## 🧠 How the System Works (The 6-Step Pipeline)

When a recruiter uploads a batch of resumes, our backend processes them through a strict, automated pipeline:

1. **Secure Upload:** The system receives the PDF resumes and securely stores them in the cloud.
2. **Text Extraction:** We use specialized tools to instantly read all the visual text inside the PDF document.
3. **Quality Control:** If a PDF is corrupted, scanned poorly, or illegible, the system immediately flags and discards it to protect data integrity.
4. **AI Reading (The LLM):** We send the raw, messy text of the resume to an advanced AI model. The AI acts as a human reader—it extracts the candidate's skills, years of experience, education, and languages into a clean, organized digital profile.
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

## 🛠️ Tech Stack

This backend is built for speed, scalability, and relational data integrity:

- **Runtime:** Node.js
- **Framework:** Express.js (RESTful API Architecture)
- **Database:** MySQL (Hosted on Aiven for cloud reliability)
- **ORM:** Prisma (For strict database modeling and type safety)
- **Security:** Helmet, Express-Rate-Limit, Zod (Payload Validation)
- **File Storage:** Cloudinary (For secure PDF hosting)
- **Document Parsing:** `pdf-parse` (For raw text extraction)
- **AI Integration:** OpenAI API (For unstructured data parsing)

---

## ⚙️ Architecture & Security Rules

This API follows strict RESTful conventions and Separation of Concerns (SoC). Routes are decoupled into dedicated resources to ensure the codebase remains maintainable and scalable.

1. **Multi-Tenancy Isolation:** All operations are strictly scoped via `userId = req.user.id`. Global system aggregation by standard users is restricted.
2. **Role-Based Access Control (RBAC):** Distinct isolation between `USER` and `ADMIN` roles. Only `ADMIN` can access global system endpoints.
3. **Data Integrity:** All protected routes require a valid JWT via the `Authorization` header.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MySQL Database

### Installation

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install

   ```

3. Set up your environment variables (see `.env.example`).

4. Generate the Prisma Client and push the schema:

   ```bash
   npx prisma generate
   npx prisma db push

   npm run dev

   📖 API Reference Summary
   Authentication (/api/users)
   POST /api/users - Register a new user.
   ```

POST /api/users/login - Authenticate and receive JWT.

Dashboard (/api/dashboard)
GET /api/dashboard - Retrieve user-scoped metrics (positions, CVs, active vacancies).

Core Entities (Protected via JWT)
Positions (/api/positions): CRUD operations for job roles and required technical/soft skills.

Vacancies (/api/vacancies): Manage active job openings and track vacancy status (OPEN, CONTACTING, FILLED).

Candidates (/api/candidates): Retrieve candidate profiles and semantic match results.

Uploads (/api/uploads): POST multipart/form-data PDF extraction engine.

Admin Module (/api/admin)
Requires ADMIN role.

GET /api/admin/users - List all system users.

GET /api/admin/stats - Global system metrics.

PUT /api/admin/:id/role - Modify user access privileges.
