import express from "express";
import prisma from "../lib/prisma.js"
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { catchAsync } from "../lib/catchAsync.js";
import { title } from "process";

const router = express.Router();

const vacanciesSelectObject = {
    id: true,
    title: true,
    openDate: true,
    closeDate: true,
    createdAt: true
}

const buildVacanciesData = (payload) => {
    return {
        title: payload.title,
        openDate: new Date(payload.openDate),
        closeDate: new Date(payload.closeDate)
    }
}

router.get('/', catchAsync(async (req, res, next) => {
    const allVacancies = await prisma.vacancy.findMany({
        select: {
            ...vacanciesSelectObject,
            matchResults: true
        }
    });

    return sendResponseOr404(res, allVacancies, "Vacancies");
}));

router.post('/', catchAsync(async (req, res, next) => {
    const payload = req.body;

    if (!payload || Object.keys(payload).length === 0) return res.status(400).json({ error: "No data provided in the request body" });
    if (!payload.title || !payload.positionId || !payload.openDate || !payload.closeDate) return res.status(400).json({ success: false, error: "Missing required fields: 'tile', 'openDate', 'closeDate', 'positionId' are mandatory." });

    const positionExists = await prisma.position.findUnique({
        where: { id: payload.positionId }
    });

    if (!positionExists) {
        return res.status(404).json({
            success: false,
            message: `Position with ${payload.positionId} was not found. Cannot create vacancy`
        });
    }


    const newVacancies = await prisma.vacancy.create({
        data: {
            ...buildVacanciesData(payload),
            positionId: payload.positionId
        },

        include: {
            matchResults: true
        }
    });

    console.log("Database write sucessful:", newVacancies);
    return res.status(201).json({ message: 'Data received successfully' });
}));

router.param('id', catchAsync(async (req, res, next, id) => {
    const idSearch = parseInt(id);
    if (isNaN(idSearch)) return res.status(400).json({ error: "Vancancies IDs only accept numeric values" });

    req.idSearch = idSearch;
    next();
}));

router.get('/:id', catchAsync(async (req, res, next) => {
    const vacancy = await prisma.vacancy.findUnique({
        where: { id: req.idSearch }
    })

    return sendResponseOr404(res, vacancy, "Vacancy");
}));

router.put('/:id', catchAsync(async (req, res, next) => {
    const payload = req.body;

    const vacancy = await prisma.vacancy.update({
        where: { id: req.idSearch },
        data: {
            ...buildVacanciesData(payload)
        }
    });

    return sendResponseOr404(res, vacancy, "Vacancy");
}));

router.delete('/:id', catchAsync(async (req, res, next) => {
    const vacancy = await prisma.vacancy.delete({
        where: { id: req.idSearch }
    })

    return sendResponseOr404(res, vacancy, "Vacancy");
}));

export default router;