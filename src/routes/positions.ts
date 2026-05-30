import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import {
  deletePosition,
  getOnePosition,
  getPositions,
  completePosition,
  sendPositions,
  updatePosition,
} from "../controllers/positions.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import {
  deletePositionSchema,
  getOnePositionSchema,
  sendPositionSchema,
  updatePositionSchema,
} from "../validations/positionValidation.js";
import upload from "../middlewares/upload/multerConfig.js";

const router = express.Router();

router.get("/", catchAsync(getPositions));

router.post("/", catchAsync(sendPositions));

router.post("/complete", upload.single("pdf"), catchAsync(completePosition));

router.get("/:id", catchAsync(getOnePosition));

router.put("/:id", catchAsync(updatePosition));

router.delete(
  "/:id",
  validate(deletePositionSchema),
  catchAsync(deletePosition),
);

export default router;
