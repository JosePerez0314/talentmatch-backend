import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import {
  getDepartments,
  getOneDepartment,
  sendDepartments,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departments.controller.js";

const router = express.Router();

router.get("/", catchAsync(getDepartments));

router.post("/", catchAsync(sendDepartments));

router.get("/:id", catchAsync(getOneDepartment));

router.put("/:id", catchAsync(updateDepartment));

router.delete("/:id", catchAsync(deleteDepartment));

export default router;
