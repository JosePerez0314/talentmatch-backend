import express from "express";
import prisma from "../lib/prisma.js";
import { sendResponseOr404 } from "../lib/responseHandler.js";
import { catchAsync } from "../lib/catchAsync.js";
import { deletePosition, getOnePosition, getPositions, sendPositions, updatePosition } from "../controllers/positionsController.js";
import { validate } from "../middlewares/validation/validateMiddleware.js"
import { deletePositionSchema, getOnePositionSchema, sendPositionSchema, updatePositionSchema } from "../validations/positionValidation.js";

const router = express.Router();

router.get('/', catchAsync(getPositions));

router.post('/', validate(sendPositionSchema), catchAsync(sendPositions));

router.get('/:id', validate(getOnePositionSchema), catchAsync(getOnePosition));

router.put('/:id', validate(updatePositionSchema), catchAsync(updatePosition));

router.delete('/:id', validate(deletePositionSchema), catchAsync(deletePosition));


export default router;