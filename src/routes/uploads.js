import express from "express";
import upload from '../middlewares/upload/multerConfig.js';
import { catchAsync } from "../lib/catchAsync.js";
import { processResumes } from "../controllers/uploadController.js";


const router = express.Router();

router.post('/', upload.array('pdfs', 100), catchAsync(processResumes));

export default router;