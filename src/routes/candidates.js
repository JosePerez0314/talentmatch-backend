import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { getCandidates } from "../controllers/getAllCandidates.js";

const router = express.Router();

router.get('/', catchAsync(async (req, res, next) => {
    return getCandidates(req, res, next);
}));

export default router;