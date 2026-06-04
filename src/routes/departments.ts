import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import {
  sendDepartmentSchema,
  departmentsParamsSchema,
  updateDepartmentSchema,
} from "../validations/department.validation.js";
import {
  getDepartments,
  getOneDepartment,
  sendDepartments,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departments.controller.js";

const router = express.Router();

router.get("/", catchAsync(getDepartments));

router.post("/", validate(sendDepartmentSchema), catchAsync(sendDepartments));

router.get(
  "/:id",
  validate(departmentsParamsSchema),
  catchAsync(getOneDepartment),
);

router.put(
  "/:id",
  validate(updateDepartmentSchema),
  catchAsync(updateDepartment),
);

router.delete(
  "/:id",
  validate(departmentsParamsSchema),
  catchAsync(deleteDepartment),
);

export default router;
