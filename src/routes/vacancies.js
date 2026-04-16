import express from "express";
import prisma from "../lib/prisma.js"
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { catchAsync } from "../lib/catchAsync.js";
import { matchResult } from "../controllers/matchResultController.js";
import { changeStatus, getAllVacancies, getOneVacancy, sendVacancies, vacancyParam } from "../controllers/vacancyController.js";

const router = express.Router();

const vacanciesSelectObject = {
    id: true,
    title: true,
    openDate: true,
    closeDate: true,
    createdAt: true,
    status: true
}

const buildVacanciesData = (payload) => {
    return {
        title: payload.title,
        openDate: new Date(payload.openDate),
        closeDate: new Date(payload.closeDate)
    }
}

router.get('/', catchAsync(async (req, res, next) => {
    getAllVacancies(req, res, next);
}));

router.post('/', catchAsync(async (req, res, next) => {
    sendVacancies(req, res, next);
}));

router.param('id', (req, res, next, id) => {
    vacancyParam(req, res, next, id);
});

router.get('/:id', catchAsync(async (req, res, next) => {
    getOneVacancy(req, res, next);
}));

router.get('/:id/results', catchAsync(async (req, res, next) => {
    const allMatchResults = await prisma.matchResult.findMany({
        where: { vacancyId: req.idSearch }
    });

    return sendResponseOr404(res, allMatchResults, 'Match Results');
}));

router.post('/:id/results', catchAsync(async (req, res, next) => {
    matchResult(req, res, next);
}));

router.patch('/:id/status', catchAsync(async (req, res, next) => {
    changeStatus(req, res, next);
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