import express from "express";
import upload from "../middlewares/upload/multerConfig.js";
import { catchAsync } from "../lib/catchAsync.js";
import {
  changeCandidateStatus,
  changeStatus,
  deleteVacancy,
  evaluateCandidates,
  getAllVacancies,
  getOneVacancy,
  getVacancyResults,
  sendVacancies,
  updateVacancy,
  uploadCandidate,
} from "../controllers/vacancies.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import {
  sendVacancySchema,
  updateVacancySchema,
  vacanciesParamsSchema,
  changeStatusSchema,
  changeCandidateStatusSchema,
} from "../validations/vacancy.validation.js";

const router = express.Router();

router.get("/", catchAsync(getAllVacancies));

router.post("/", validate(sendVacancySchema), catchAsync(sendVacancies));

router.get("/:id", validate(vacanciesParamsSchema), catchAsync(getOneVacancy));

router.get(
  "/:id/results",
  validate(vacanciesParamsSchema),
  catchAsync(getVacancyResults),
);

router.post(
  "/:id/upload",
  upload.array("pdfs", 100),
  validate(vacanciesParamsSchema),
  catchAsync(uploadCandidate),
);

router.post(
  "/:id/evaluations",
  validate(vacanciesParamsSchema),
  catchAsync(evaluateCandidates),
);

router.patch(
  "/:id/status",
  validate(changeStatusSchema),
  catchAsync(changeStatus),
);

router.patch(
  "/:vacancyId/candidates/:candidateId/status",
  validate(changeCandidateStatusSchema),
  catchAsync(changeCandidateStatus),
);

router.put("/:id", validate(updateVacancySchema), catchAsync(updateVacancy));

router.delete(
  "/:id",
  validate(vacanciesParamsSchema),
  catchAsync(deleteVacancy),
);

export default router;
