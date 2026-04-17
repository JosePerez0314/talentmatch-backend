import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { matchResult } from "../controllers/matchResultController.js";
import { changeStatus, deleteVacancy, getAllVacancies, getOneVacancy, getVacancyResults, sendVacancies, sendVacancyResults, updateVacancy, vacancyParam } from "../controllers/vacancyController.js";

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
    getVacancyResults(req, res, next);
}));

router.post('/:id/results', catchAsync(async (req, res, next) => {
    sendVacancyResults(req, res, next);
}));

router.patch('/:id/status', catchAsync(async (req, res, next) => {
    changeStatus(req, res, next);
}));

router.put('/:id', catchAsync(async (req, res, next) => {
    updateVacancy(req, res, next);
}));

router.delete('/:id', catchAsync(async (req, res, next) => {
    deleteVacancy(req, res, next);
}));


export default router;