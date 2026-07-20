# Scoring Logic — Candidate Match Score

> How TalentMatch AI turns a CV and a Position into a deterministic `matchScore` from 0 to 100.

**Source of truth:** `src/utils/scoringEngine.ts`
**Caller:** `src/controllers/vacancies.controller.ts` → `evaluateCandidates`
**Persisted in:** `MatchResult` (`prisma/schema.prisma`)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Where scoring sits in the pipeline](#2-where-scoring-sits-in-the-pipeline)
3. [Inputs and contracts](#3-inputs-and-contracts)
4. [The weight distribution](#4-the-weight-distribution)
5. [Component-by-component logic](#5-component-by-component-logic)
   - [5.1 Hard Skills — 30%](#51-hard-skills--30)
   - [5.2 Experience — 20%](#52-experience--20)
   - [5.3 Role — 15%](#53-role--15)
   - [5.4 Languages — 15%](#54-languages--15)
   - [5.5 Education — 10%](#55-education--10)
   - [5.6 Soft Skills — 10%](#56-soft-skills--10)
6. [The output: `MatchScoreResult`](#6-the-output-matchscoreresult)
7. [Persistence and rounding](#7-persistence-and-rounding)
8. [Worked examples](#8-worked-examples)
9. [Design invariants](#9-design-invariants)
10. [Known gaps and edge cases](#10-known-gaps-and-edge-cases)

---

## 1. Overview

The scoring engine is **deterministic by design**. The LLM never assigns the score — it only *structures* unstructured CV text into a normalized JSON profile. Once that JSON exists, the score is pure arithmetic:

```
matchScore = hardSkills + experience + role + languages + education + softSkills
```

Each term is capped at its own weight, so the sum is bounded by `[0, 100]` and rounded once at the end.

This separation exists so that:

- The same candidate + same position always yields the same score (auditable, reproducible).
- A model change or prompt change cannot silently shift rankings.
- Recruiters can be shown a **breakdown**, not a black-box number.

---

## 2. Where scoring sits in the pipeline

```
POST /api/vacancies/:id/upload
  └─ PDF → Cloudinary
     └─ pdf-parse → raw text
        └─ quality gate (< 500 chars → rejected)
           └─ SHA-256 hash dedup (per user)
              └─ OpenAI extraction → Candidate row
                 └─ Application row (candidate ↔ vacancy)

POST /api/vacancies/:id/evaluations     ← separate, explicit step
  └─ load pending Applications (no MatchResult yet for this vacancy)
     └─ p-limit(5) concurrency
        ├─ matchEngine()          ← OpenAI: normalizes candidate vs position
        └─ calculateMatchScore()  ← THIS DOCUMENT: pure, synchronous, no I/O
           └─ prisma.matchResult.create()
```

Two things to note:

- **Upload and evaluation are decoupled.** Uploading a CV never scores it. Evaluation is triggered explicitly, which is what allows a candidate reused across vacancies (same CV hash, same user) to be scored independently per vacancy.
- `calculateMatchScore` is **pure**: no `await`, no database, no network. It is trivially unit-testable and safe to run inside the concurrency limiter.

Failure isolation: each candidate is evaluated inside its own `try/catch`. A candidate whose OpenAI normalization fails returns an error object into the results array; the rest of the batch still completes and the endpoint still answers `201`.

---

## 3. Inputs and contracts

`calculateMatchScore(position, normalizedCandidate)` takes two objects.

### Position (the requirement baseline)

```ts
interface Position {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  educationLevel: string;
  educationArea: string;
  softSkills: string[];
}
```

Built by `positionEngineSelectObject(vacancy.position)` in the controller.

### Normalized Candidate (the AI-structured profile)

```ts
interface Candidate {
  technicalSkills: string[];
  yearsOfExperience: number;
  role: string;
  languages: string[];
  educationLevel: string;
  educationArea: string;
  softSkills: string[];
  aiAnalysis?: {
    projectHighlights?: string[];
  };
}
```

Produced by `matchEngine()` (`src/prompts/matchEngine.prompt.ts`), which calls the OpenAI Responses API with a stored prompt ID and returns parsed JSON matching `NormalizedCandidate`.

### Guard clause

```ts
if (!position || !normalizedCandidate) return { totalScore: 0, breakdown };
```

A missing side yields `0` with an **empty breakdown** — not a breakdown of zeros. Consumers must not assume `breakdown.technical` exists on a zero score.

---

## 4. The weight distribution

```ts
const WEIGHTS = {
  TECHNICAL_SKILLS: 0.30,
  EXPERIENCE:       0.20,
  ROLE:             0.15,
  LANGUAGES:        0.15,
  EDUCATION:        0.10,
  SOFT_SKILLS:      0.10,
};
```

| Component | Weight | Max points | Shape |
|---|---:|---:|---|
| Hard / technical skills | 30% | 30 | Linear ratio |
| Experience | 20% | 20 | Threshold + fallback |
| Role | 15% | 15 | Binary |
| Languages | 15% | 15 | Linear ratio |
| Education | 10% | 10 | Ordinal ladder, proportional |
| Soft skills | 10% | 10 | Linear ratio |
| **Total** | **100%** | **100** | |

Weights are multiplied by `100` inside the engine (`WEIGHTS.X * 100`), so each component is expressed directly in points, not in fractions.

---

## 5. Component-by-component logic

### 5.1 Hard Skills — 30%

```ts
const matchedTech = position.technicalSkills.filter(skill =>
  candidateTechSkillsLower.includes(skill.toLowerCase())
);

techScore = position.technicalSkills.length > 0
  ? (matchedTech.length / position.technicalSkills.length) * 30
  : 30;
```

- **Direction matters:** the engine iterates over the *position's* required skills and asks whether the candidate has each one. Extra skills the candidate holds that the position never asked for contribute nothing. This is intentional — the score measures *fit to requirement*, not raw breadth.
- Matching is **case-insensitive exact string equality**. `"Node.js"` matches `"node.js"`, but not `"NodeJS"` or `"Node"`. Normalizing that variance is the LLM's job upstream.
- **Empty requirement → full credit.** A position listing no technical skills gives every candidate the full 30 points.
- `matched` is returned in the breakdown so the UI can show *which* skills hit.

### 5.2 Experience — 20%

Three branches, evaluated in order:

```ts
if (candidate.yearsOfExperience >= position.yearsOfExperience) {
  expScore = 20;                                   // (a) meets the bar
} else if (highlights.length > 0) {
  expScore = 10;                                   // (b) the "lifesaver"
} else {
  expScore = position.yearsOfExperience > 0
    ? (candidate.yearsOfExperience / position.yearsOfExperience) * 20
    : 0;                                           // (c) proportional
}
```

**(a) Meets or exceeds** → full 20. There is no bonus for overshooting; 10 years against a 3-year requirement scores the same as 3.

**(b) The "lifesaver."** A candidate who falls short on formal years but whose `aiAnalysis.projectHighlights` is non-empty gets a flat 10 points instead of a raw proportional penalty. The intent is to avoid auto-rejecting strong self-taught or project-heavy profiles — a career-changer with two serious shipped projects and one year of formal experience is not the same as someone with one year and nothing to show.

Note the condition is **presence, not quality**: a single highlight string is enough to trigger it. The engine does not read the highlights; it only counts them.

**(c) Proportional fallback.** No highlights → linear ratio against the requirement. If the position requires `0` years and the candidate somehow reaches this branch, the score is `0` — but this is unreachable in practice, since `candidate.yearsOfExperience >= 0` always satisfies branch (a) when the requirement is `0`.

### 5.3 Role — 15%

```ts
roleScore = candidate.role.toLowerCase() === position.role.toLowerCase() ? 15 : 0;
```

Strictly binary and strictly exact (case-insensitive). `"Backend Developer"` vs `"Backend Engineer"` scores **0** — a 15-point cliff on wording alone.

This puts real weight on the LLM normalizing the candidate's title toward the position's vocabulary during the `matchEngine` step. It is the single most brittle component in the engine.

### 5.4 Languages — 15%

Identical shape to hard skills:

```ts
lanScore = position.languages.length > 0
  ? (matchedLan.length / position.languages.length) * 15
  : 15;
```

Position-driven, case-insensitive exact match, empty requirement → full credit. Proficiency level is not modeled — a language is either present or absent.

### 5.5 Education — 10%

Education is the only component using an **ordinal ladder**:

```ts
const EDUCATION_LEVELS = {
  NONE: 0,
  HIGH_SCHOOL: 1,
  BACHELOR: 2,
  TECHNICAL: 3,
  UNIVERSITY: 4,
  MASTER: 5,
  DOCTORATE: 6,
};
```

Lookup is case-insensitive with a safe default:

```ts
const getEducationLevel = (education: string) =>
  EDUCATION_LEVELS[education.toUpperCase()] ?? 0;
```

Any unrecognized string — including the literal `"NONE"` — resolves to `0` rather than throwing.

```ts
educationScore =
  positionEduLevel === 0 || candidateEduLevel >= positionEduLevel
    ? 10
    : (candidateEduLevel / positionEduLevel) * 10;
```

- **No requirement** (`positionEduLevel === 0`) → full 10.
- **Meets or exceeds** → full 10.
- **Below** → **proportional, not zero.** A `HIGH_SCHOOL` (1) candidate against a `UNIVERSITY` (4) requirement gets `1/4 * 10 = 2.5` points. Education degrades gracefully; it never guillotines.

`educationArea` is present on both interfaces but **is not read by the scoring engine**. Field-of-study relevance is currently unscored.

### 5.6 Soft Skills — 10%

Same linear-ratio shape as hard skills and languages, position-driven, case-insensitive, empty requirement → full credit.

---

## 6. The output: `MatchScoreResult`

```ts
interface MatchScoreResult {
  totalScore: number;                                              // rounded 0–100
  breakdown: Record<string, { score: number; matched?: unknown[] }>;
}
```

`breakdown` keys, in insertion order: `technical`, `experience`, `role`, `languages`, `education`, `softSkills`.

Only the three set-intersection components carry `matched`:

| Key | `score` | `matched` |
|---|---|---|
| `technical` | 0–30 | required skills the candidate has |
| `experience` | 0–20 | — |
| `role` | 0 or 15 | — |
| `languages` | 0–15 | required languages the candidate has |
| `education` | 0–10 | — |
| `softSkills` | 0–10 | required soft skills the candidate has |

`totalScore` is `Math.round(finalScore)` — rounded **once**, from the unrounded sum.

---

## 7. Persistence and rounding

The controller flattens the breakdown into `MatchResult` columns:

```ts
matchScore:       match.totalScore,
educationScore:   Math.round(match.breakdown.education.score),
experienceScore:  Math.round(match.breakdown.experience.score),
hardSkillsScore:  Math.round(match.breakdown.technical.score),
languagesScore:   Math.round(match.breakdown.languages.score),
roleScore:        Math.round(match.breakdown.role.score),
softSkillsScore:  Math.round(match.breakdown.softSkills.score),
```

⚠️ **The stored components will not always sum exactly to `matchScore`.** `matchScore` rounds the total once; each component rounds independently. With six components, accumulated rounding can drift the component sum from `matchScore` by up to ±3 points. Do not treat the column sum as a checksum, and do not recompute the total from the columns in the UI — display `matchScore` directly.

Also persisted alongside the numbers:

- `normalizedCandidate` — the full AI-normalized JSON, stored as an **audit snapshot** so a past evaluation can be explained even after the source `Candidate` row changes.
- `redFlags`, `summary` — pulled from `aiAnalysis`; narrative only, never scored.

`MatchResult` carries `@@unique([candidateId, vacancyId])`, so a candidate is scored at most once per vacancy. Re-running evaluation only picks up Applications with no existing `MatchResult` for that vacancy.

---

## 8. Worked examples

**Position:** role `"Backend Node.js Developer"`, 3 years, skills `[Node.js, Express, MySQL, TypeScript]`, languages `[Spanish, English]`, soft `[Communication, Problem Solving]`, education `UNIVERSITY`.

### Strong candidate

4 years · all 4 skills · exact role · both languages · both soft skills · `UNIVERSITY`

| Component | Calculation | Points |
|---|---|---:|
| Hard skills | 4/4 × 30 | 30 |
| Experience | 4 ≥ 3 → full | 20 |
| Role | exact match | 15 |
| Languages | 2/2 × 15 | 15 |
| Education | 4 ≥ 4 → full | 10 |
| Soft skills | 2/2 × 10 | 10 |
| **Total** | | **100** |

### Partial candidate (lifesaver path)

1 year · 2/4 skills · exact role · both languages · 1/2 soft skills · `UNIVERSITY` · has `projectHighlights`

| Component | Calculation | Points |
|---|---|---:|
| Hard skills | 2/4 × 30 | 15 |
| Experience | 1 < 3, highlights present → flat | 10 |
| Role | exact match | 15 |
| Languages | 2/2 × 15 | 15 |
| Education | 4 ≥ 4 → full | 10 |
| Soft skills | 1/2 × 10 | 5 |
| **Total** | | **70** |

Without the lifesaver, experience would have been `1/3 × 20 = 6.67` and the total `67`.

### Weak candidate

1 year · 0/4 skills · role `"Frontend Developer"` · 1/2 languages · 0/2 soft skills · `HIGH_SCHOOL` · no highlights

| Component | Calculation | Points |
|---|---|---:|
| Hard skills | 0/4 × 30 | 0 |
| Experience | 1/3 × 20 | 6.67 |
| Role | mismatch | 0 |
| Languages | 1/2 × 15 | 7.5 |
| Education | 1/4 × 10 | 2.5 |
| Soft skills | 0/2 × 10 | 0 |
| **Total** | `16.67` → round | **17** |

---

## 9. Design invariants

Hold these when modifying the engine:

1. **Purity.** No I/O, no `await`, no `Date.now()`, no randomness. Same inputs → same output, forever.
2. **The AI never scores.** The LLM's only job is structuring text. If a change makes the model produce a number that reaches `finalScore`, the determinism guarantee is gone.
3. **Weights sum to 1.0.** Adding a component means taking weight from another. A silent sum above 1.0 lets scores exceed 100.
4. **Requirement-driven direction.** Always iterate the position's arrays and probe the candidate's. Reversing it measures breadth instead of fit.
5. **Round once, at the end.** Never round intermediate component scores inside the engine.
6. **Degrade, don't guillotine.** Every current component either scales proportionally or is explicitly binary by design (role). Introducing a hard zero-out is a product decision, not a refactor.

---

## 10. Known gaps and edge cases

Documented as observed in the code — these are **not** bugs to fix silently; each is a product decision to make deliberately.

**The "guillotine" is not implemented.** Project notes describe a rule that heavily penalizes a *missing mandatory* hard skill. The engine has no such branch: hard skills are a flat linear ratio with no concept of a mandatory skill. A candidate missing the single most critical requirement loses only its proportional slice (e.g. 7.5 of 30 with four required skills) and can still score well overall.

**Empty requirements award full credit.** A position with `technicalSkills: []`, `languages: []`, and `softSkills: []` hands every candidate 55 points before anything is evaluated. Sparsely-filled positions inflate scores across the board and compress the ranking.

**The education ladder ordering is questionable.** `BACHELOR: 2` sits *below* `TECHNICAL: 3` and `UNIVERSITY: 4`. Depending on the intended reading of these labels, a bachelor's degree may be ranked under a technical qualification. Any change here shifts every historical comparison, so it needs an explicit decision.

**The lifesaver can score *lower* than the proportional path.** The flat 10 points applies whenever highlights exist, even when the ratio would have paid more. A candidate with 2.5 of 3 required years scores `2.5/3 × 20 = 16.67` with no highlights, but only `10` with them — having project highlights costs them 6.67 points. A `Math.max` between the two branches would remove the penalty.

**Role is a 15-point cliff on wording.** Exact string equality means any title phrasing drift zeroes the component. The engine is fully dependent on upstream LLM normalization for this one.

**`educationArea` and `optionalTechnicalSkills` are collected but unscored.** Both are extracted, stored, and passed into the engine, but no branch reads them. Field-of-study relevance and nice-to-have skills currently contribute nothing.

**Language proficiency is binary.** Present or absent; no A1–C2 or native/fluent distinction.

**No penalty from `redFlags`.** `aiAnalysis.redFlags` is persisted and shown to recruiters but never affects the score.

---

## Related documents

- `docs/en/backend-documentation.md` — full architecture reference
- `docs/en/api-documentation.md` — endpoint contract, including `POST /api/vacancies/:id/evaluations`
- `docs/en/context/scoring-engine.md` — condensed context/persona prompt
- `docs/es/scoring-logic.md` — Spanish version of this document
