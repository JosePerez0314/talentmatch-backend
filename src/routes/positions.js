import express from "express";
import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";

const router = express.Router();

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
};

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

router.get('/', async (req, res, next) => {
    try {
        const allPositions = await prisma.position.findMany({
            select: {
                ...positionSelectObject,
            }
        });

        return res.status(200).json({ allPositions });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    const payload = req.body; // JSON container applied in index.js

    // Check if the payload exists and is not empty
    if (!payload || Object.keys(payload).length === 0) return res.status(400).json({ error: "No data provided in the request body" });

    // Validate the absolute minimum required fields for the Database
    if (!payload.role || !payload.userId) return res.status(400).json({ success: false, error: "Missing required fields: 'role' and 'userId' are mandatory." });

    try {
        const newPosition = await prisma.position.create({
            data: {
                ...buildPositionData(payload),
                userId: payload.userId
            }
        });

        console.log("Database write successful:", newPosition.role);

        return res.status(201).json({ message: 'Data received successfully' });

    } catch (error) {
        next(error);
    }
});

router.param('id', (req, res, next, id) => {
    const idSearch = parseInt(id);

    if (isNaN(idSearch)) return res.status(400).json({ error: "Position IDs only accept numeric values" });

    req.idSearch = idSearch;
    next();
});

router.get('/:id', async (req, res, next) => {
    try {
        const position = await prisma.position.findUnique({
            where: { id: req.idSearch },
            select: {
                ...positionSelectObject
            }
        });

        return sendResponseOr404(res, position, "Position");

    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    const payload = req.body;
    try {
        const position = await prisma.position.update({
            where: { id: req.idSearch },
            data: {
                ...buildPositionData(payload)
            }
        });
        return sendResponseOr404(res, position, "Position");

    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const position = await prisma.position.delete({
            where: { id: req.idSearch }
        });

        return res.status(200).json({ message: "Position successfully deleted." });

    } catch (error) {
        next(error);
    }
});

export default router;