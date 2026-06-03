import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import {
  deletePosition,
  getOnePosition,
  getPositions,
  completePosition,
  sendPositions,
  updatePosition,
  duplicatePosition,
} from "../controllers/positions.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import {
  sendPositionSchema,
  positionsParamsSchema,
  updatePositionSchema,
} from "../validations/position.validation.js";
import upload from "../middlewares/upload/multerConfig.js";

const router = express.Router();

router.get("/", catchAsync(getPositions));

router.post("/", validate(sendPositionSchema), catchAsync(sendPositions));

router.post("/complete", upload.single("pdf"), catchAsync(completePosition));

router.post(
  "/duplicate/:id",
  validate(positionsParamsSchema),
  catchAsync(duplicatePosition),
);

router.get("/:id", validate(positionsParamsSchema), catchAsync(getOnePosition));

router.put("/:id", validate(updatePositionSchema), catchAsync(updatePosition));

router.delete(
  "/:id",
  validate(positionsParamsSchema),
  catchAsync(deletePosition),
);

export default router;
