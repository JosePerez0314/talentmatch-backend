import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get('/', async (req, res) => {
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
        return res.status(500).json({
            error: "Failed to fetch Positions"
        })
    }
});

router.post('/', async (req, res) => {
    const payload = req.body; // JSON container aplied in index.js

    if (!payload) {
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
        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" });
    }
});

export default router;