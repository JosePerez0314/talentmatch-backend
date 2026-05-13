import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.ts";

const positionSelectObject = {
    id: true,
    role: true,
    yearsOfExperience: true,
    technicalSkills: true,
    optionalTechnicalSkills: true,
    softSkills: true,
    description: true,
    education: true,
    createdAt: true
}

export const getPositions = async (req, res, next) => {
    const allPositions = await prisma.position.findMany({
        where: {
            userId: req.user.id
        },
        select: {
            ...positionSelectObject
        }
    });

    return res.status(200).json({
        success: true,
        data: allPositions
    });
}

export const sendPositions = async (req, res, next) => {
    const data = req.validated.body;

    const newPosition = await prisma.position.create({
        data: {
            ...data,
            userId: req.user.id
        }
    });

    console.log("Database write successful:", newPosition.role);

    return res.status(201).json({
        succes: true,
        data: newPosition
    });
}

export const getOnePosition = async (req, res, next) => {
    const { id } = req.validated.params;

    const position = await prisma.position.findFirst({
        where: {
            id,
            userId: req.user.id,
        },
        select: {
            ...positionSelectObject
        }
    });

    return sendResponseOr404(res, position, "Position");
}

export const updatePosition = async (req, res, next) => {
    const { id } = req.validated.params;
    const data = req.validated.body;

    const position = await prisma.position.findFirst({
        where: {
            id,
            userId: req.user.id
        }
    });

    if (!position) {
        return res.status(404).json({
            success: false,
            message: "Position not found or unauthorized"
        });
    }

    const updated = await prisma.position.update({
        where: { id },
        data
    });

    return sendResponseOr404(res, updated, "Position");
};

export const deletePosition = async (req, res, next) => {
    const { id } = req.validated.params;

    const position = await prisma.position.findFirst({
        where: {
            id,
            userId: req.user.id,
        }
    });

    if (!position) {
        return res.status(404).json({
            success: false,
            message: "Position not found or unauthorized"
        });
    }

    await prisma.position.delete({
        where: {
            id
        }
    });

    return res.status(200).json({
        success: true,
        message: "Position deleted successfully"
    });
}
