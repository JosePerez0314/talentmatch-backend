import express from "express";
import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { catchAsync } from "../lib/catchAsync.js";
import { deletePosition, getOnePosition, getPositions, positionsParam, sendPositions, updatePosition } from "../controllers/positionsController.js";

const router = express.Router();

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