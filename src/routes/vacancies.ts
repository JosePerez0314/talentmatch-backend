import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import {
  changeStatus,
  deleteVacancy,
  getAllVacancies,
  getOneVacancy,
  getVacancyResults,
  sendVacancies,
  updateVacancy,
} from "../controllers/vacancies.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import {
  sendVacancySchema,
  updateVacancySchema,
  vacanciesParamsSchema,
  changeStatusSchema,
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

router.patch(
  "/:id/status",
  validate(changeStatusSchema),
  catchAsync(changeStatus),
);

router.put("/:id", validate(updateVacancySchema), catchAsync(updateVacancy));

router.delete(
  "/:id",
  validate(vacanciesParamsSchema),
  catchAsync(deleteVacancy),
);

export default router;
