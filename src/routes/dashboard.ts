import express from "express"
import { catchAsync } from "../lib/catchAsync.js";
import { getSummary } from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get('/', catchAsync(getSummary));

export default router;