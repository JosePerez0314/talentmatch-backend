import express from "express";
import upload from '../middlewares/upload/multerConfig.js';
import { catchAsync } from "../lib/catchAsync.ts";
import { processResumes } from "../controllers/uploadController.js";
import { validate } from "../middlewares/validation/validateMiddleware.js";
import { processResumesSchema } from "../validations/uploadValidation.js";


const router = express.Router();

router.post('/', upload.array('pdfs', 100), validate(processResumesSchema), catchAsync(processResumes));

export default router;