import express from "express";
import upload from '../middlewares/multerConfig.js';
import { catchAsync } from "../lib/catchAsync.js";

const router = express.Router();

router.post('/', upload.array('pdfs', 100), catchAsync(async (req, res) => {
    const pdfFiles = req.files;

    // Validate if one or multiples PDFs files exists
    if (!pdfFiles || pdfFiles.length === 0) return res.status(400).json({ error: "No PDFs uploaded" });

    const processedCandidates = [];

    for (const pdfFile of pdfFiles) {
        console.log(`Processsing file: ${pdfFile}`);

        // [TODO 1]: Pipe the file buffer into pdf-parse to get raw text
        // [TODO 2]: Send that text to OpenAI (Prompt 1) to get the JSON match
        // [TODO 3]: Save the JSON to your Prisma database (Candidate & MatchResult)

        // processedCandidates.push(databaseResult);
    }

    return res.status(201).json({
        message: "PDF upload successfully to Cloudinary!",
        fileData: pdfFiles
    });
}));

export default router;