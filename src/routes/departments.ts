import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import {
  sendDepartmentSchema,
  getOneDepartmentSchema,
  updateDepartmentSchema,
  deleteDepartmentSchema,
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
  validate(getOneDepartmentSchema),
  catchAsync(getOneDepartment),
);

router.put(
  "/:id",
  validate(updateDepartmentSchema),
  catchAsync(updateDepartment),
);

router.delete(
  "/:id",
  validate(deleteDepartmentSchema),
  catchAsync(deleteDepartment),
);

export default router;
