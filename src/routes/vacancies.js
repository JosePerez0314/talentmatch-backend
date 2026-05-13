import express from "express";
import { catchAsync } from "../lib/catchAsync.ts";
import { matchResult } from "../controllers/matchResultController.js";
import { changeStatus, deleteVacancy, getAllVacancies, getOneVacancy, getVacancyResults, sendVacancies, updateVacancy } from "../controllers/vacancyController.js";
import { validate } from "../middlewares/validation/validateMiddleware.js"
import { changeStatusSchema, deleteVacancySchema, getOneVacancySchema, getVacancyResultsSchema, sendVacancySchema, updateVacancySchema } from "../validations/vacancyValidation.js";

const router = express.Router();

router.get('/', catchAsync(getAllVacancies));

router.post('/', validate(sendVacancySchema), catchAsync(sendVacancies));

router.get('/:id', validate(getOneVacancySchema), catchAsync(getOneVacancy));

router.get('/:id/results', validate(getVacancyResultsSchema), catchAsync(getVacancyResults))

router.patch('/:id/status', validate(changeStatusSchema), catchAsync(changeStatus));

router.put('/:id', validate(updateVacancySchema), catchAsync(updateVacancy));

router.delete('/:id', validate(deleteVacancySchema), catchAsync(deleteVacancy));

export default router;