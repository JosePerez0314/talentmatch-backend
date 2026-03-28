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

router.get('/:id', async (req, res) => {
    const idSearch = parseInt(req.params.id);

    if (isNaN(idSearch)) return res.status(400).json({ error: "Vancancies IDs only accept numeric values" });

    try {
        const vacancy = await prisma.vacancy.findUnique({
            where: { id: idSearch }
        })

        return vacancy ? res.status(200).json(vacancy) : res.status(404).json({ error: "Vacancy not found" });
    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" });
    }
});

router.put('/:id', async (req, res) => {
    const payload = req.body;
    const idSearch = parseInt(req.params.id);
    if (isNaN(idSearch)) return res.status(400).json({ error: "Vacancies IDs only accept numeric values" });

    try {
        const vacancy = await prisma.vacancy.update({
            where: { id: idSearch },
            data: {
                title: payload.title || undefined,
                openDate: payload.openDate ? new Date(payload.openDate) : undefined,
                closeDate: payload.closeDate ? new Date(payload.closeDate) : undefined,
            }
        });

        return vacancy ? res.status(200).json(vacancy) : res.status(404).json({ error: "Vacancy not Found" })
    } catch (error) {
        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" });
    }
});

router.delete('/:id', async (req, res) => {
    const idSearch = parseInt(req.params.id);
    if (isNaN(idSearch)) return res.status(400).json({ error: "Vancancies IDs only accept numeric values" });

    try {
        const vacancy = await prisma.vacancy.delete({
            where: { id: idSearch }
        })

        return res.status(200).json({ message: "Vacancy successfully deleted" });
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ error: "Vacancy not found or already deleted" });

        console.error("Database error", error);
        return res.status(500).json({ error: "Internal server error during database operation" });
    }
});

export default router;