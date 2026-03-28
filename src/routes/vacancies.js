import express from "express";
import prisma from "../lib/prisma.js"

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const allVacancies = await prisma.vacancy.findMany({
            include: {
                matchResults: true
            }
        });
        return res.status(200).json({ allVacancies })
    } catch (error) {
        return res.status(500).json({
            error: "Failed to fetch Vacancies"
        })
    }
});

router.post('/', async (req, res) => {
    const payload = req.body;
    if (Object.keys(payload).length === 0) {
        return res.status(400).json({ error: "Error to receive the data" });
    }

    try {
        const newVacancies = await prisma.vacancy.create({
            data: {
                title: payload.title,
                openDate: new Date(payload.openDate),
                closeDate: new Date(payload.closeDate),
                positionId: payload.positionId
            },

            include: {
                matchResults: true
            }
        });

        console.log("Database write sucessful:", newVacancies);
        return res.status(200).json({ message: 'Data receive successfully' });
    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" });
    }
});

router.put('/:id', async (req, res) => { });

router.delete('/:id', async (req, res) => { });

export default router;