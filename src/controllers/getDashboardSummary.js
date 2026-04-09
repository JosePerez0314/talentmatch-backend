import { title } from "process";
import prisma from "../lib/prisma.js";

export const getSummary = async (req, res, next) => {
    try {
        const now = new Date();

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
            prisma.vacancy.count({
                where: {
                    openDate: { lte: now },   // lte = less than or equal to 'now'
                    closeDate: { gte: now }  // gte = greater than or equal to 'now'
                }
            }),
            prisma.vacancy.count(
                {
                    where: {
                        closeDate: { lt: now }
                    }
                }),
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