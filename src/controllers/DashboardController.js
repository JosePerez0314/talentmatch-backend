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
            prisma.position.count({ where: { userId: req.user.id } }),
            prisma.candidate.count({ where: { userId: req.user.id } }),
            prisma.vacancy.count({
                where: {
                    status: 'OPEN',
                    userId: req.user.id
                }
            }),
            prisma.vacancy.count({
                where: {
                    status: 'FILLED',
                    userId: req.user.id
                }
            }),
            prisma.position.findFirst({
                where: {
                    userId: req.user.id
                },
                orderBy: { createdAt: 'desc' },
                select: { role: true }
            }),
            prisma.candidate.findFirst({
                where: {
                    userId: req.user.id
                },
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
        next(error)
    }
}