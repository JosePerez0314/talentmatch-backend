import express from "express"
import { catchAsync } from "../lib/catchAsync.js";
import { getSummary } from "../controllers/getDashboardSummary.js";

const router = express.Router();

router.get('/', catchAsync(async (req, res, next) => {
    getSummary(req, res, next);
}));

export default router;