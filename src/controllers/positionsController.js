import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";

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

const buildPositionData = (payload) => {
    return {
        role: payload.role,
        yearsOfExperience: payload.yearsOfExperience,
        technicalSkills: payload.technicalSkills,
        optionalTechnicalSkills: payload.optionalTechnicalSkills,
        softSkills: payload.softSkills,
        description: payload.description,
        education: payload.education,
        languages: payload.languages,
    };
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
    const payload = req.body; // JSON container applied in index.js

    // Check if the payload exists and is not empty
    if (!payload || Object.keys(payload).length === 0) {
        return res.status(400).json({
            success: false,
            error: "No data provided in the request body"
        });
    }

    if (!payload.role) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: role"
        });
    }

    const data = buildPositionData(payload);

    Object.keys(data).forEach(key => {
        if (data[key] === undefined) delete data[key];
    });

    const newPosition = await prisma.position.create({
        data: {
            data,
            userId: req.user.id
        }
    });

    console.log("Database write successful:", newPosition.role);
    return res.status(201).json({
        succes: true,
        data: newPosition
    });
}

export const positionsParam = async (req, res, next, id) => {
    const idSearch = parseInt(id);

    if (!Number.isInteger(idSearch)) {
        return res.status(400).json({
            succes: false,
            error: "Position ID must be a valid integer"
        });
    }

    if (isNaN(idSearch)) {
        return res.status(400).json({
            succes: false,
            error: "Position IDs only accept numeric values"
        });
    }

    req.idSearch = idSearch;
    next();
}

export const getOnePosition = async (req, res, next) => {
    const position = await prisma.position.findFirst({
        where: {
            userId: req.user.id,
            id: req.idSearch
        },
        select: {
            ...positionSelectObject
        }
    });

    return sendResponseOr404(res, position, "Position");
}

export const updatePosition = async (req, res, next) => {
    const payload = req.body;

    const positionExists = await prisma.position.findFirst({
        where: {
            userId: req.user.id,
            id: req.idSearch
        }
    });

    if (!positionExists) {
        return res.status(404).json({
            success: false,
            message: "Position not found or unauthorized"
        });
    }

    const data = buildPositionData(payload);

    Object.keys(data).forEach(key => {
        if (data[key] === undefined) delete data[key];
    });

    const position = await prisma.position.update({
        where: {
            id: req.idSearch
        },
        data: {
            data
        }
    });

    return sendResponseOr404(res, position, "Position");
}

export const deletePosition = async (req, res, next) => {
    const positionExists = await prisma.position.findFirst({
        where: {
            userId: req.user.id,
            id: req.idSearch
        }
    });

    if (!positionExists) {
        return res.status(404).json({
            success: false,
            message: "Position not found or unauthorized"
        });
    }
    const position = await prisma.position.delete({
        where: {
            id: req.idSearch
        }
    });

    return sendResponseOr404(res, position, "Position");
}
