import express from "express";
import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { catchAsync } from "../lib/catchAsync.js";
import { deletePosition, getOnePosition, getPositions, positionsParam, sendPositions, updatePosition } from "../controllers/positionsController.js";

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

router.get('/', catchAsync(async (req, res, next) => {
    getPositions(req, res, next);
}));

router.post('/', catchAsync(async (req, res, next) => {
    sendPositions(req, res, next);
}));

router.param('id', (req, res, next, id) => {
    positionsParam(req, res, next, id);
});

router.get('/:id', catchAsync(async (req, res, next) => {
    getOnePosition(req, res, next);
}));

router.put('/:id', catchAsync(async (req, res, next) => {
    updatePosition(req, res, next);
}));

router.delete('/:id', catchAsync(async (req, res, next) => {
    deletePosition(req, res, next);
}));

export default router;