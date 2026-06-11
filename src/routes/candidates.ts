import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { getCandidates } from "../controllers/candidates.controller.js";
import { getOneCandidate } from "../controllers/candidates.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import { candidatesParamsSchema } from "../validations/candidate.validation.js";

const router = express.Router();

router.get("/", catchAsync(getCandidates));

router.get(
  "/:id",
  validate(candidatesParamsSchema),
  catchAsync(getOneCandidate),
);

export default router;
