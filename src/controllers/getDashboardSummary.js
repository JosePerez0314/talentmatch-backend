import { title } from "process";
import prisma from "../lib/prisma.js";

export const getSummary = async (req, res, next) => {
    try {
        const [
            positionsCount,
            cvsCount,
            activeVacancies,
            closedVacancies,
            lastPosition,
            lastCv
        ] = await Promise.all([
            prisma.position.count(),
            prisma.candidate.count(),
            prisma.vacancy.count({ where: { openDate: null } }),
            prisma.vacancy.count({ where: { closeDate: { not: null } } }),
            prisma.position.findFirst({
                orderBy: { createdAt: 'desc' },
                select: { role: true }
            }),
            prisma.candidate.findFirst({
                orderBy: { createdAt: 'desc' },
                select: { fullName: true }
            })
        ]);

        return res.status(200).json({
            success: true,
            data: {
                positionsCount,
                cvsCount,
                activeVacancies,
                closedVacancies,
                lastPosition: lastPosition ? { title: lastPosition.role } : null,
                lastCv: lastCv ? { title: lastCv.fullName } : null
            }
        });

    } catch (error) {
        console.error("[Dashboard Summary Error]:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch dashboard summary."
        });
    }
}