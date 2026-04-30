// ⚠️ DEV-ONLY: Match preview / debugging endpoint
// Not used in production flow (MVP uses batch matching)

import prisma from "../lib/prisma.js";
import { computeMatch } from "../services/computeMatchService.js";

export const matchResult = async (req, res, next) => {
    const { vacancyId, candidateId } = req.body;

    try {
        const vacancy = await prisma.vacancy.findFirst({
            where: {
                id: vacancyId,
                userId: req.user.id
            },
            include: { position: true }
        });

        const candidate = await prisma.candidate.findFirst({
            where: {
                id: candidateId,
                userId: req.user.id
            },
            select: {
                rawApiPayload: true,
            }
        });

        if (!vacancy || !candidate) {
            return res.status(404).json({
                success: false,
                message: "Vacancy or Candidate not found"
            });
        }

        const result = await computeMatch(prisma, vacancy, candidate);

        return res.status(200).json({
            success: true,
            data: result
        });


    } catch (error) {
        next(error)
    }
} 