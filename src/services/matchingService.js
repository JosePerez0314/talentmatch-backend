import pLimit from "p-limit";
import { computeMatch } from "./computeMatchService.js";
import { upsertMatchResult } from "../repositories/matchRepository.js";

export const matchAllCandidatesToVacancy = async (prisma, vacancy, userId) => {

    console.time("matching");

    const candidates = await prisma.candidate.findMany({
        where: { userId }
    });

    if (!Array.isArray(candidates) || candidates.length === 0) {
        console.timeEnd("matching");
        return;
    }

    console.log("Candidates:", candidates.length);

    // Compute phase
    const results = await Promise.all(
        candidates.map(async (candidate) => {
            try {
                return await computeMatch(vacancy, candidate);
            } catch (error) {
                console.error(
                    `Match failed (candidate ${candidate.id}, vacancy ${vacancy.id})`,
                    error.message
                );
                return null;
            }
        })
    );

    console.log("RAW RESULTS:", results);

    const validResults = results.filter(Boolean);

    console.log("Valid results:", validResults.length);

    // Controlled DB writes
    const limit = pLimit(5);

    await Promise.all(
        validResults.map(result =>
            limit(() =>
                upsertMatchResult(prisma, result, userId)
            )
        )
    );

    console.timeEnd("matching");
};

export const matchCandidateToVacancies = async (prisma, candidate, userId) => {
    console.time("candidate-matching");

    const vacancies = await prisma.vacancy.findMany({
        where: { userId },
        include: { position: true }
    });

    console.log("Vacancies", vacancies)
    console.log("Candidates", candidate)


    if (!vacancies.length) {
        console.timeEnd("candidate-matching");
        return;
    }

    const results = await Promise.all(
        vacancies.map(async (vacancy) => {
            try {
                return await computeMatch(vacancy, candidate);
            } catch (err) {
                console.error(
                    `Match failed (candidate ${candidate.id}, vacancy ${vacancy.id})`,
                    err.message
                );
                return null;
            }
        })
    );

    const valid = results.filter(Boolean);

    await Promise.all(
        valid.map(r => upsertMatchResult(prisma, r, userId))
    );

    console.timeEnd("candidate-matching");
};