import { computeMatch } from "./computeMatch.js";

export const matchCandidateToAllVacancies = async (prisma, userId, candidate) => {
    const vacancies = await prisma.vacancy.findMany({
        where: {
            position: {
                userId: userId
            }
        },
        include: { position: true }
    });

    if (!vacancies) {
        throw new Error("Not vacancies found");
    }

    if (!Array.isArray(vacancies)) {
        throw new Error("Vacancies is not an array");
    }

    for (const vacancy of vacancies) {
        try {
            await computeMatch(prisma, vacancy, candidate);
        } catch (error) {
            console.error(`Match failed (candidate ${candidate.id}, vacancy ${vacancy.id})`, error.message);
        }
    }

}