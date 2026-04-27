import prisma from "../lib/prisma.js"
import { sendResponseOr404 } from "../lib/responseHandler.js";

export const getStats = async (req, res, next) => {
    try {
        const [
            usersCount,
            candidatesCount,
            positionsCount,
            vacanciesCount,
            activeVacancies,
            closedVacancies
        ] = await Promise.all([
            prisma.user.count(),
            prisma.candidate.count(),
            prisma.position.count(),
            prisma.vacancy.count(),
            prisma.vacancy.count({ where: { status: "OPEN" } }),
            prisma.vacancy.count({ where: { status: "FILLED" } })
        ]);

        return res.status(200).json({
            success: true,
            data: {
                usersCount,
                candidatesCount,
                positionsCount,
                vacanciesCount,
                activeVacancies,
                closedVacancies
            }
        });

    } catch (error) {
        next(error);
    }
};

export const getAllUsers = async (req, res, next) => {
    try {
        const AllUsers = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                AllUsers
            }
        });
    } catch (error) {
        next(err)
    }
}

export const updateUserRole = async (req, res, next) => {
    const { role } = req.body;
    const targetUserId = parseInt(req.params.id);

    if (!["ADMIN", "USER"].includes(role)) {
        return res.status(400).json({
            success: false,
            error: "Invalid role"
        });
    }

    if (req.user.id === targetUserId) {
        return res.status(403).json({
            success: false,
            error: "You cannot modify your own role"
        });
    }

    const user = await prisma.user.update({
        where: {
            id: targetUserId
        },
        data: {
            role
        },
        select: {
            id: true,
            email: true,
            role: true,
            updatedAt: true
        }
    });

    return sendResponseOr404(res, user, "User");
};

export const deleteUser = async (req, res, next) => {
    const user = await prisma.user.delete({
        where: {
            id: parseInt(req.params.id)
        },
    });

    return sendResponseOr404(res, user, "User");
}
