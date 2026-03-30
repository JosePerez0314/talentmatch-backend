import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const allPositions = await prisma.position.findMany({
            select: {
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
        });

        return res.status(200).json({ allPositions });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    const payload = req.body; // JSON container aplied in index.js

    if (Object.keys(payload).length === 0) {
        res.status(400).json({ error: "Error to receive the data" });
        return;
    }

    try {
        const newPosition = await prisma.position.create({
            data: {
                role: payload.role,
                yearsOfExperience: payload.yearsOfExperience,
                technicalSkills: payload.technicalSkills,
                optionalTechnicalSkills: payload.optionalTechnicalSkills,
                softSkills: payload.softSkills,
                description: payload.description,
                education: payload.education,
                languages: payload.languages,
                userId: payload.userId
            }
        });

        console.log("Database write succesful:", newPosition.role);

        return res.status(201).json({ message: 'Data receive successfully' });

    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    const idSearch = parseInt(req.params.id);
    if (isNaN(idSearch)) return res.status(400).json({ error: "Position IDs only accept numeric values" });

    try {
        const position = await prisma.position.findUnique({
            where: { id: idSearch },
            select: {
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
        });

        return position ? res.status(200).json(position) : res.status(404).json({ error: "Position not found" });

    } catch (error) {
        next(error);
    }
});

router.put('/:id', async (req, res, next) => {
    const payload = req.body;
    const idSearch = parseInt(req.params.id);
    if (isNaN(idSearch)) return res.status(400).json({ error: "Position IDs only accept numeric values" });

    try {
        const position = await prisma.position.update({
            where: { id: idSearch },
            data: {
                role: payload.role,
                yearsOfExperience: payload.yearsOfExperience,
                technicalSkills: payload.technicalSkills,
                optionalTechnicalSkills: payload.optionalTechnicalSkills,
                softSkills: payload.softSkills,
                description: payload.description,
                education: payload.education,
                languages: payload.languages,
            }
        });

        return position ? res.status(200).json(position) : res.status(404).json({ error: "Position not found" });

    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    const idSearch = parseInt(req.params.id);
    if (isNaN(idSearch)) return res.status(400).json({ error: "Position IDs only accept numeric values" });

    try {
        const position = await prisma.position.delete({
            where: { id: idSearch }
        });

        return res.status(200).json({ message: "Position successfully deleted." });

    } catch (error) {
        next(error);
    }
});

export default router;